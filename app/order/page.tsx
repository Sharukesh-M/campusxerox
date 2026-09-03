import { redirect } from 'next/navigation';

export default function OrderPageRedirect() {
  redirect('/dashboard/new-order');
}
