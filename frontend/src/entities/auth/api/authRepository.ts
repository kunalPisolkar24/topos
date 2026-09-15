import { useMutation } from "@apollo/client/react";
import {
  SigninDocument,
  SignupDocument,
  type SigninMutation,
  type SigninMutationVariables,
  type SignupMutation,
  type SignupMutationVariables,
} from "@/shared/graphql/generated/graphql";

/**
 * AuthRepository — port for authentication operations.
 * Follows Dependency Inversion: UI depends on this abstraction,
 * not on concrete Apollo documents.
 */
export interface AuthRepository {
  useSignin(): ReturnType<typeof useMutation<SigninMutation, SigninMutationVariables>>;
  useSignup(): ReturnType<typeof useMutation<SignupMutation, SignupMutationVariables>>;
}

export const authRepository: AuthRepository = {
  useSignin() {
    return useMutation<SigninMutation, SigninMutationVariables>(SigninDocument);
  },
  useSignup() {
    return useMutation<SignupMutation, SignupMutationVariables>(SignupDocument);
  },
};
