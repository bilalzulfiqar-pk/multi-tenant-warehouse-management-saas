import { AuthFlowLoadingScreen } from "@/components/auth/auth-flow-loading-screen";

export default function Loading() {
  return (
    <AuthFlowLoadingScreen
      title="Preparing sign in"
      message="Checking your session and opening the right page..."
    />
  );
}
