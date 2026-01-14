import { User } from '../../generated/prisma/client';
import { SignupInput, SigninInput, UpdateProfileInput } from '../../types';

export interface UserResponse extends Omit<User, 'createdAt'> {
    createdAt: string;
}

export interface AuthResponse {
    user: UserResponse;
    token: string;
}

export interface PaginationArgs {
    limit: number;
    cursor?: number;
}

export interface IUserService {
    signup(data: SignupInput): Promise<AuthResponse>;
    signin(data: SigninInput): Promise<AuthResponse>;
    findById(id: number): Promise<UserResponse | null>;
    findByIds(ids: readonly number[]): Promise<(UserResponse | null)[]>;
    findAll(args: PaginationArgs): Promise<UserResponse[]>;
    updateProfile(userId: number, data: UpdateProfileInput): Promise<UserResponse>;
}