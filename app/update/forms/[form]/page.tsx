import { notFound } from 'next/navigation';
import { FORM_IDS, getFormSpec } from '@/app/lib/formSpec';
import FormClient from './FormClient';

export function generateStaticParams() {
  return FORM_IDS.map(form => ({ form }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ form: string }> }) {
  const { form } = await params;
  return { title: getFormSpec(form)?.title ?? 'Staff form' };
}

export default async function Page({ params }: { params: Promise<{ form: string }> }) {
  const { form } = await params;
  if (!getFormSpec(form)) notFound();
  return <FormClient formId={form} />;
}
