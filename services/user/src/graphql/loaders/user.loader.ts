import DataLoader from 'dataloader';
import { IUserService } from '../../services/interfaces/user.service.interface';
import { UserResponse } from '../../services/interfaces/user.service.interface';

export type UserLoader = DataLoader<number, UserResponse | null>;

export const createUserLoader = (userService: IUserService): UserLoader => {
    return new DataLoader<number, UserResponse | null>(async (ids) => {
        return userService.findByIds(ids);
    });
};