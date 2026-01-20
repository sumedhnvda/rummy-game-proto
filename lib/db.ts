import mongoose from 'mongoose';

// Connection function
export const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;

    try {
        const URI = process.env.MONGODB_URI;
        if (!URI) {
            console.warn("⚠️ MONGO_URI is missing in environment variables.");
            // Only fall back in dev/test, or throw in prod
            if (process.env.NODE_ENV === 'production') {
                throw new Error("MONGO_URI must be set in production.");
            }
        }

        await mongoose.connect(URI || "mongodb+srv://sumedhnavuda:%408217nvda@cluster0.evh93.mongodb.net/?retryWrites=true&w=majority");
        console.log("MongoDB Connected");
    } catch (error) {
        console.error("MongoDB Connection Failed:", error);
    }
};

// Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    coins: { type: Number, default: 1000 },
    matchesWon: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const matchSchema = new mongoose.Schema({
    roomId: String,
    winnerId: String, // Maps to Socket ID or Username
    players: [String],
    timestamp: { type: Date, default: Date.now }
});

// Models configuration (prevent overwrite during hot reload)
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Match = mongoose.models.Match || mongoose.model('Match', matchSchema);
