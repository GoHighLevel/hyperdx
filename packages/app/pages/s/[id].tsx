import { SharedLogLink } from '@/components/LogShare';
import { withAppNav } from '@/layout';

export default function LogSharePage() {
  return <SharedLogLink />;
}

LogSharePage.getLayout = withAppNav;
