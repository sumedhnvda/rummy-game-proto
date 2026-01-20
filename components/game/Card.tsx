import clsx from "clsx";
import { Card as CardType } from "@/lib/game/types";

// Simple SVG or CSS representation could be better, but text for now or simple icons
const SUIT_ICONS: Record<string, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣'
};

const SUIT_COLORS: Record<string, string> = {
    spades: 'text-black',
    hearts: 'text-red-600',
    diamonds: 'text-red-600',
    clubs: 'text-black'
};

interface CardProps {
    card: CardType;
    onClick?: () => void;
    selected?: boolean;
}

export const Card = ({ card, onClick, selected }: CardProps) => {
    if (card.isJoker) {
        return (
            <div
                onClick={onClick}
                className={clsx(
                    "w-16 h-24 bg-purple-100 border-2 rounded-lg flex flex-col items-center justify-center cursor-pointer select-none transition-transform hover:-translate-y-2 shadow-sm",
                    selected ? "border-blue-500 -translate-y-4 shadow-lg ring-2 ring-blue-300" : "border-purple-300"
                )}>
                <span className="text-xs font-bold text-purple-600">JOKER</span>
                <span className="text-2xl">🃏</span>
            </div>
        )
    }

    return (
        <div
            onClick={onClick}
            className={clsx(
                "w-16 h-24 bg-white border-2 rounded-lg flex flex-col items-center justify-between p-1 cursor-pointer select-none transition-transform hover:-translate-y-2 shadow-sm",
                selected ? "border-blue-500 -translate-y-4 shadow-lg ring-2 ring-blue-300" : "border-gray-200",
                SUIT_COLORS[card.suit]
            )}>
            <div className="self-start text-sm font-bold">{card.rank}</div>
            <div className="text-2xl">{SUIT_ICONS[card.suit]}</div>
            <div className="self-end text-sm font-bold rotate-180">{card.rank}</div>
        </div>
    );
};
