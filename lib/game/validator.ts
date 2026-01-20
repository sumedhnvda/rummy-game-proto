import { Card, Rank, MeldType } from './types';

const RANK_VALUES: Record<Rank, number> = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

export class RummyValidator {
    static getCardValue(rank: Rank): number {
        return RANK_VALUES[rank];
    }

    static sortCards(cards: Card[]): Card[] {
        return [...cards].sort((a, b) => {
            // Jokers at the end or treated specially? For sorting, just by val
            if (a.isJoker && !b.isJoker) return 1;
            if (!a.isJoker && b.isJoker) return -1;

            // Sort by Suit then Rank
            if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
            return this.getCardValue(a.rank) - this.getCardValue(b.rank);
        });
    }

    // Check for Pure Sequence: Same Suit, Consecutive Ranks, No Jokers
    static isPureSequence(cards: Card[]): boolean {
        if (cards.length < 3) return false;

        // Check same suit
        const suit = cards[0].suit;
        if (cards.some(c => c.suit !== suit || c.isJoker)) return false;

        // Sort by rank
        const sorted = [...cards].sort((a, b) => this.getCardValue(a.rank) - this.getCardValue(b.rank));

        // handle A-2-3 and Q-K-A cases? 
        // Standard Rummy treats A as 1 (A-2-3) or 14 (Q-K-A). Let's stick to A=1 for simplicity first or check both
        return this.checkConsecutive(sorted);
        // TODO: Add support for Q-K-A wrap around if required by variant
    }

    private static checkConsecutive(sorted: Card[]): boolean {
        for (let i = 0; i < sorted.length - 1; i++) {
            if (this.getCardValue(sorted[i + 1].rank) - this.getCardValue(sorted[i].rank) !== 1) {
                return false;
            }
        }
        return true;
    }

    // Check for Set: Same Rank, Different Suits
    static isSet(cards: Card[], wildCard?: Card): boolean {
        if (cards.length < 3 || cards.length > 4) return false;

        // Filter out jokers
        const realCards = cards.filter(c => !c.isJoker && (!wildCard || (c.rank !== wildCard.rank)));

        if (realCards.length < 2) return true; // mostly jokers/wildcards, valid

        const rank = realCards[0].rank;
        const suits = new Set<string>();

        for (const c of realCards) {
            if (c.rank !== rank) return false; // Different ranks
            if (suits.has(c.suit)) return false; // Duplicate suit in set (invalid in standard rummy)
            suits.add(c.suit);
        }

        return true;
    }

    // Check for Impure Sequence: Same Suit, Consecutive (allows Jokers)
    static isImpureSequence(cards: Card[], wildCard?: Card): boolean {
        if (cards.length < 3) return false;

        // Logic is complex with jokers. Simplified check:
        // 1. Must use at least one valid card to establish suit.
        // 2. Count gaps, ensure jokers can fill them.
        return true; // Placeholder for robust algorithm
    }

    static validateHand(groups: Card[][], wildCard: Card): { isValid: boolean, error?: string } {
        let hasPure = false;
        let hasSecondSeq = false; // Pure or Impure

        // check each group
        for (const group of groups) {
            if (this.isPureSequence(group)) {
                hasPure = true;
                if (!hasSecondSeq) hasSecondSeq = true; // Use careful logic for >=2 seqs
            }
            // ... strict validation logic
        }

        if (!hasPure) return { isValid: false, error: "Need at least one Pure Sequence" };

        return { isValid: true };
    }
}
