import { Redirect } from 'expo-router';

/** @deprecated Use /auth/register with Passenger selected */
export default function RegisterPassengerRedirect() {
  return <Redirect href="/auth/register?role=passenger" />;
}
