import express from "express"
import helmet from "helmet"
import cors from "cors"
import cookieParser from "cookie-parser"
import authRoutes from './routes/authRoutes.js'
import sessionRoutes from './routes/sessionRoutes.js'
import {notFound, errorHandler } from './middlewares/errorHandler.js';
import mfaRoutes from './routes/mfaRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import qrRoutes from './routes/qrRoutes.js';
import ssoRoutes from './routes/ssoRoutes.js';
import adminRoutes from './routes/adminRoutes.js';


const app = express()

app.set('trust proxy', 1);
app.use(helmet())
app.use(cors({origin:process.env.CLIENT_URL, credentials: true }))
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.use(express.urlencoded({ extended: false }));

app.get("/health",(req,resp)=>resp.json("🚀 Backend is running successfully! ✅"))

app.use('/auth', authRoutes);
app.use("/sessions",sessionRoutes);
app.use('/mfa', mfaRoutes);   
app.use('/auth/oauth', oauthRoutes);
app.use('/qr', qrRoutes);
app.use('/sso', ssoRoutes);
app.use('/admin', adminRoutes);


app.use(notFound);
app.use(errorHandler);  

export default app;
