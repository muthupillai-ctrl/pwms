import { JwtPayload } from '../modules/auth/jwt.service';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
