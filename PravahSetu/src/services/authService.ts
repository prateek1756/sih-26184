import { User } from '../types';
import { DEMO_USER } from '../data/mockUser';

const USER_SESSION_KEY = 'cyber_suraksha_auth_user';

export class AuthService {
  static getCurrentUser(): User | null {
    try {
      const stored = localStorage.getItem(USER_SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  }

  static loginWithPassword(identifier: string): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user: User = {
          ...DEMO_USER,
          mobile: identifier.includes('@') ? DEMO_USER.mobile : identifier,
          email: identifier.includes('@') ? identifier : DEMO_USER.email,
        };
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
        resolve(user);
      }, 700);
    });
  }

  static sendOtp(mobile: string): Promise<{ success: boolean; simulatedOtp: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Deterministic or friendly demo OTP
        const simulatedOtp = '261840';
        resolve({ success: true, simulatedOtp });
      }, 600);
    });
  }

  static verifyOtp(mobile: string, otp: string): Promise<User> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (otp.length === 6) {
          const user: User = {
            ...DEMO_USER,
            mobile: mobile || DEMO_USER.mobile,
          };
          localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
          resolve(user);
        } else {
          reject(new Error('Invalid 6-digit OTP entered. Please try again.'));
        }
      }, 600);
    });
  }

  static register(data: {
    fullName: string;
    mobile: string;
    email: string;
    state: string;
    district: string;
  }): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser: User = {
          id: `usr-${Math.floor(1000 + Math.random() * 9000)}`,
          ...data,
          isVerified: true,
        };
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(newUser));
        resolve(newUser);
      }, 800);
    });
  }

  static logout(): void {
    localStorage.removeItem(USER_SESSION_KEY);
  }
}
