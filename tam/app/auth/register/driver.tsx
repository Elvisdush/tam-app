import { Redirect } from 'expo-router';

/** @deprecated Use /auth/register with Driver selected */
export default function RegisterDriverRedirect() {
  return <Redirect href="/auth/register?role=driver" />;
}
