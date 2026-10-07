import mongoose from "mongoose";

const connectMongoDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("please define MONGODB_URI in environment");
  }

  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error.message);
  });

  try {
    const con = await mongoose.connect(MONGODB_URI);
    console.log("connected to:", con.connections[0].host);
  } catch (error) {
    // Rethrow so the caller can decide whether to keep running.
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
};

export default connectMongoDB;