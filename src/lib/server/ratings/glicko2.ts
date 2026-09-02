/**
 * Glicko-2, per Glickman's paper (http://www.glicko.net/glicko/glicko2.pdf).
 * tau = 0.5, a common choice that reasonably constrains volatility drift.
 */

export interface Rating {
	rating: number;
	deviation: number;
	volatility: number;
}

export interface OpponentResult {
	opponent: Rating;
	score: 0 | 0.5 | 1;
}

const TAU = 0.5;
const SCALE = 173.7178;

function g(phi: number): number {
	return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, opponentMu: number, opponentPhi: number): number {
	return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function illness(x: number, deltaSq: number, v: number, phi: number, volSq: number): number {
	const ex = Math.exp(x);
	return (
		(ex * (deltaSq - v - phi * phi - ex)) / (v + phi * phi + ex) ** 2 -
		(x - Math.log(volSq)) / TAU ** 2
	);
}

export function updateRating(player: Rating, opponents: OpponentResult[]): Rating {
	const mu = (player.rating - 1500) / SCALE;
	const phi = player.deviation / SCALE;

	if (opponents.length === 0) {
		const newPhi = Math.sqrt(phi * phi + player.volatility ** 4);
		return {
			rating: player.rating,
			deviation: Math.min(350, SCALE * newPhi),
			volatility: player.volatility
		};
	}

	const prepared = opponents.map((o) => ({
		mu: (o.opponent.rating - 1500) / SCALE,
		phi: o.opponent.deviation / SCALE,
		score: o.score
	}));

	let vSum = 0;
	let dSum = 0;
	for (const o of prepared) {
		const e = expectedScore(mu, o.mu, o.phi);
		vSum += g(o.phi) ** 2 * e * (1 - e);
		dSum += g(o.phi) * (o.score - e);
	}
	const v = 1 / vSum;
	const delta = v * dSum;

	// Volatility solve: steps 5.1-5.5 of the paper.
	const deltaSq = delta * delta;
	const phiSq = phi * phi;
	const a = Math.log(player.volatility ** 2);

	const f = (x: number) => illness(x, deltaSq, v, phi, player.volatility ** 2);

	let A = a;
	let B = deltaSq - phiSq - v > 0 ? Math.log(deltaSq - phiSq - v) : a - TAU;
	let fA = f(A);
	let fB = f(B);

	// Widen the bracket until it truly straddles the root.
	let guard = 0;
	while (fA * fB > 0 && guard < 200) {
		B += TAU;
		fB = f(B);
		guard++;
	}
	for (let i = 0; i < 100 && Math.abs(B - A) > 0.000001; i++) {
		const C = A + ((A - B) * fA) / (fA - fB);
		const fC = f(C);
		if (fC * fB > 0) {
			A = B;
			fA = fB;
		}
		B = C;
		fB = fC;
	}
	const newVolatility = Math.exp(A / 2);

	// Steps 6-8.
	const phiStar = Math.sqrt(phiSq + newVolatility * newVolatility);
	const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
	const newMu = mu + newPhi * newPhi * dSum;

	return {
		rating: 1500 + SCALE * newMu,
		deviation: SCALE * newPhi,
		volatility: newVolatility
	};
}

export function isProvisional(deviation: number): boolean {
	return deviation >= 350;
}
