import { notFound } from 'next/navigation';
import { FORM_IDS, getFormSpec } from '@/app/lib/formSpec';
import FormClient from './FormClient';

export function generateStaticParams() {
  return FORM_IDS.map(form => ({ form }));
}
export const dynamicParams = false;

export function generateMetadata({ params }: { params: { form: string } }) {
  return { title: getFormSpec(params.form)?.title ?? 'Staff form' };
}

export default function Page({ params }: { params: { form: string } }) {
  if (!getFormSpec(params.form)) notFound();
  return <FormClient formId={params.form} />;
}
