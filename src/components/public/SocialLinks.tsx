import type { ReactNode } from 'react';

type SocialAccount = {
  name: string;
  href: string;
  mark: ReactNode;
};

const accounts: SocialAccount[] = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/share/1G77aXUG9N/',
    mark: <path d="M13.4 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V13h2.7v8h3.2Z" />,
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/conceptcleaningservices?rpxt=MWRybjk3enFxdWQ4Mw==',
    mark: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="18" cy="6.5" r="1.2" /></>,
  },
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@conceptcleaners?_r=1&_t=ZS-9BQl3T0d62M',
    mark: <path d="M15.5 3h-3.2v11.2a3 3 0 1 1-2.6-3v-3.3a6.3 6.3 0 1 0 5.8 6.3V8.4a8.1 8.1 0 0 0 4.2 1.2V6.3A4.9 4.9 0 0 1 15.5 3Z" />,
  },
  {
    name: 'YouTube',
    href: 'https://youtube.com/@conceptcleaningservices?si=V7_VfMZe3z5iBoMR',
    mark: <><path d="M23 7.1a3 3 0 0 0-2.1-2.1C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9Z" /><path d="m9.8 15.5 5.9-3.5-5.9-3.5v7Z" fill="white" /></>,
  },
  {
    name: 'X',
    href: 'https://x.com/Conceptcleanin',
    mark: <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.4l7.3-8.4L1.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" />,
  },
];

export default function SocialLinks() {
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold">Follow us</p>
      <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Concept Cleaning Services social media accounts">
        {accounts.map((account) => (
          <li key={account.name}>
            <a
              href={account.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Follow Concept Cleaning Services on ${account.name} (opens in a new tab)`}
              title={account.name}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-current/20 px-3 text-xs font-semibold text-current transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                {account.mark}
              </svg>
              <span>{account.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
