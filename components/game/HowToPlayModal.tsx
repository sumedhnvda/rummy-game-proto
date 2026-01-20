import { useState } from "react";

export const HowToPlayModal = () => {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white text-black rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
                <button
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-black font-bold text-xl"
                >
                    ✕
                </button>
                <h2 className="text-2xl font-bold mb-4 text-purple-700">How to Play Rummy</h2>

                <div className="space-y-4 text-sm text-gray-700">
                    <section>
                        <h3 className="font-bold text-lg text-black">1. Objective</h3>
                        <p>Arrange all 13 cards into valid sets and sequences. You need at least one <strong>Pure Sequence</strong>.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-black">2. On Your Turn</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Draw:</strong> Click the <span className="text-blue-600 font-bold">DECK</span> or <span className="text-red-600 font-bold">DISCARD</span> pile.</li>
                            <li><strong>Discard:</strong> Select an unwanted card and click the <span className="text-red-500 font-bold">DISCARD</span> button.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-black">3. Valid Melds</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Pure Sequence:</strong> 3+ consecutive cards of same suit (e.g., 5♥ 6♥ 7♥).</li>
                            <li><strong>Set:</strong> 3+ cards of same rank, different suits (e.g., 7♠ 7♦ 7♣).</li>
                        </ul>
                    </section>
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={() => setIsOpen(false)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-full text-lg shadow-lg active:scale-95 transition-transform"
                    >
                        Got it, Let's Play!
                    </button>
                </div>
            </div>
        </div>
    );
};
