const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.exdb7cl.mongodb.net/?appName=Cluster0`;

if (!process.env.DB_USER || !process.env.DB_PASS) {
  throw new Error("❌ DB_USER or DB_PASS missing in environment variables");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10,        
  minPoolSize: 2,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
});

//  Unexpected disconnect handle
client.on("close", () => console.warn("⚠️ MongoDB connection closed"));
client.on("error", (err) => console.error("❌ MongoDB error:", err));

module.exports = client;