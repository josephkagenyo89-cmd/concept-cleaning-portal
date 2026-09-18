import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>

        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
          404
        </p>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Page not found
        </h1>

        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          The page you are looking for may have moved, been removed, or the
          address may be incorrect.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>

          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
