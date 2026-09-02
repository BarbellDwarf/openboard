import { relations } from 'drizzle-orm';
import {
	bigserial,
	boolean,
	char,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

/**
 * Canonical persistence schema for OpenBoard.
 *
 * Table names here are a binding contract between tickets. The map issue on
 * GitHub records which ticket consumes which table. Variant win conditions are
 * stored in games.termination as short tokens, documented inline below.
 */

export const users = pgTable(
	'users',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [uniqueIndex('users_name_key').on(t.name), uniqueIndex('users_email_key').on(t.email)]
);

export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent')
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)]
);

export const oauthAccounts = pgTable(
	'oauth_accounts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		provider: text('provider').notNull(),
		providerAccountId: text('provider_account_id').notNull()
	},
	(t) => [
		uniqueIndex('oauth_provider_account_key').on(t.provider, t.providerAccountId),
		index('oauth_user_id_idx').on(t.userId)
	]
);

export const profiles = pgTable('profiles', {
	userId: uuid('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title'),
	bio: text('bio'),
	country: char('country', { length: 2 }),
	showEmailOnProfile: boolean('show_email_on_profile').default(false).notNull()
});

export const preferences = pgTable('preferences', {
	userId: uuid('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	boardTheme: text('board_theme').default('vinyl').notNull(),
	pieceSet: text('piece_set').default('cburnett').notNull(),
	soundPack: text('sound_pack').default('kenney').notNull(),
	soundVolume: integer('sound_volume').default(70).notNull(),
	animations: boolean('animations').default(true).notNull(),
	coordinates: boolean('coordinates').default(true).notNull(),
	soundsEnabled: boolean('sounds_enabled').default(true).notNull(),
	showDests: boolean('show_dests').default(true).notNull(),
	autoQueen: boolean('auto_queen').default(false).notNull(),
	boardFlavor: text('board_flavor').default('auto').notNull()
});

export const games = pgTable(
	'games',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		/** standard | chess960 | crazyhouse | kingofthehill | threecheck | atomic | horde | racingkings */
		variant: text('variant').notNull(),
		rated: boolean('rated').notNull(),
		initialMs: integer('initial_ms'),
		incrementMs: integer('increment_ms'),
		/** Correspondence only. Days allowed per move. Null for live games. */
		daysPerMove: integer('days_per_move'),
		/** created | started | finished | aborted */
		status: text('status').default('created').notNull(),
		/** white | black | draw | null while running */
		result: text('result'),
		/**
		 * checkmate | stalemate | resignation | timeout | abandoned | agreement |
		 * kingofthehill | threecheck | atomic-king-death | horde-wiped |
		 * racingkings-finish | insufficient
		 */
		termination: text('termination'),
		currentXfen: text('current_xfen'),
		pgn: text('pgn'),
		moveCount: integer('move_count').default(0).notNull(),
		whiteId: uuid('white_id').references(() => users.id, { onDelete: 'set null' }),
		blackId: uuid('black_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		startedAt: timestamp('started_at', { withTimezone: true }),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		lastMoveAt: timestamp('last_move_at', { withTimezone: true })
	},
	(t) => [
		index('games_white_idx').on(t.whiteId, t.status),
		index('games_black_idx').on(t.blackId, t.status),
		index('games_status_created_idx').on(t.status, t.createdAt)
	]
);

export const gamePlayers = pgTable(
	'game_players',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** white | black */
		color: text('color').notNull(),
		ratingBefore: integer('rating_before'),
		ratingAfter: integer('rating_after'),
		ratingDeviationBefore: integer('rating_deviation_before'),
		ratingDeviationAfter: integer('rating_deviation_after')
	},
	(t) => [uniqueIndex('game_players_game_color_key').on(t.gameId, t.color)]
);

export const moves = pgTable(
	'moves',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		ply: integer('ply').notNull(),
		uci: text('uci').notNull(),
		san: text('san').notNull(),
		xfenAfter: text('xfen_after').notNull(),
		msSinceTurnStart: integer('ms_since_turn_start'),
		clockLeftMs: integer('clock_left_ms'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [uniqueIndex('moves_game_ply_key').on(t.gameId, t.ply)]
);

export const chatMessages = pgTable(
	'chat_messages',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		gameId: uuid('game_id')
			.notNull()
			.references(() => games.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [index('chat_messages_game_created_idx').on(t.gameId, t.createdAt)]
);

export const notifications = pgTable(
	'notifications',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/**
		 * challenge-received | challenge-accepted | opponent-moved |
		 * draw-offered | game-result | reminder
		 */
		type: text('type').notNull(),
		payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
		readAt: timestamp('read_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [index('notifications_user_unread_idx').on(t.userId, t.readAt)]
);

export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true })
	},
	(t) => [uniqueIndex('push_subscriptions_endpoint_key').on(t.endpoint)]
);

export const ratings = pgTable(
	'ratings',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		variant: text('variant').notNull(),
		/** bullet | blitz | rapid | classical */
		speedClass: text('speed_class').notNull(),
		rating: real('rating').default(1500).notNull(),
		deviation: real('deviation').default(350).notNull(),
		volatility: real('volatility').default(0.06).notNull(),
		gamesPlayed: integer('games_played').default(0).notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('ratings_player_variant_speed_key').on(t.userId, t.variant, t.speedClass),
		index('ratings_leaderboard_idx').on(t.variant, t.speedClass, t.rating)
	]
);

export const challenges = pgTable(
	'challenges',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		challengerId: uuid('challenger_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** Null means the challenge sits in the open lobby pool. */
		targetId: uuid('target_id').references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull(),
		variant: text('variant').notNull(),
		rated: boolean('rated').notNull(),
		initialMs: integer('initial_ms'),
		incrementMs: integer('increment_ms'),
		daysPerMove: integer('days_per_move'),
		/** random | white | black */
		colorChoice: text('color_choice').default('random').notNull(),
		/** bullet | blitz | rapid | classical | correspondence */
		speedClass: text('speed_class').notNull(),
		/** open | accepted | declined | cancelled | expired */
		status: text('status').default('open').notNull(),
		gameId: uuid('game_id').references(() => games.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
	},
	(t) => [
		uniqueIndex('challenges_token_key').on(t.token),
		index('challenges_status_expiry_idx').on(t.status, t.expiresAt)
	]
);

export const usersRelations = relations(users, ({ many, one }) => ({
	sessions: many(sessions),
	oauthAccounts: many(oauthAccounts),
	profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
	preferences: one(preferences, { fields: [users.id], references: [preferences.userId] })
}));

export const gamesRelations = relations(games, ({ many, one }) => ({
	players: many(gamePlayers),
	moves: many(moves),
	white: one(users, { fields: [games.whiteId], references: [users.id] }),
	black: one(users, { fields: [games.blackId], references: [users.id] })
}));
