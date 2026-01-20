import { Card, Rank, Suit } from './types';
import { v4 as uuidv4 } from 'uuid';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export class Deck {
    public cards: Card[] = [];

    constructor(numDecks: number = 2, numJokers: number = 2) {
        this.initialize(numDecks, numJokers);
    }

    private initialize(numDecks: number, numJokers: number) {
        this.cards = [];
        for (let i = 0; i < numDecks; i++) {
            for (const suit of SUITS) {
                for (const rank of RANKS) {
                    this.cards.push({
                        suit,
                        rank,
                        id: uuidv4(),
                        isJoker: false
                    });
                }
            }
        }

        // Add Printed Jokers (using 'hearts' 'A' as placeholder but isJoker=true)
        for (let i = 0; i < numJokers; i++) {
            this.cards.push({
                suit: 'hearts',
                rank: 'A',
                id: uuidv4(),
                isJoker: true
            })
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(numCards: number): Card[] {
        return this.cards.splice(0, numCards);
    }

    draw(): Card | undefined {
        return this.cards.shift();
    }

    get count(): number {
        return this.cards.length;
    }

    static fromState(state: { cards: Card[] }): Deck {
        const deck = new Deck(0, 0); // Empty init
        deck.cards = state.cards;
        return deck;
    }
}
