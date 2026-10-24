import "dotenv/config"
import app from "./app.js"
import connectDB from "./config/db.js"
import { hashPassword } from "./utils/hash.js";

const start = async()=>{
    await connectDB();
    app.listen(process.env.PORT, () => {
    console.log(`🚀 Server running on port ${process.env.PORT}`);
  });
}

start();