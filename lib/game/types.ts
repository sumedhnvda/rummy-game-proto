export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
    suit: Suit;
    rank: Rank;
    isJoker?: boolean;
    id: string; // Unique ID for React keys and tracking
}

export type MeldType = 'pure_sequence' | 'impure_sequence' | 'set' | 'invalid';

export interface Meld {
    cards: Card[];
    type: MeldType;
}

export interface PlayerState {
    id: string;
    name: string;
    hand: Card[];
    isMyTurn: boolean;
    hasDropped: boolean;
}

export interface GameState {
    roomId: string;
    players: PlayerState[];
    currentTurnPlayerId: string;
    deckCount: number;
    discardPile: Card[];
    status: 'waiting' | 'playing' | 'ended';
    maxPlayers: number;
    winner?: string;
}
