import Link from "next/link";

interface PlaceholderPageProps {
  title: string;
  back?: string;
}

export default function PlaceholderPage({ title, back = "/" }: PlaceholderPageProps) {
  return (
    <main className="max-w-2xl ml-[15%] py-20 px-4">
      <Link href={back} className="text-sm text-[#111111]/40 mb-10 block">← back</Link>
      <h1 className="text-xl font-medium mb-8">{title}</h1>
    </main>
  );
}
