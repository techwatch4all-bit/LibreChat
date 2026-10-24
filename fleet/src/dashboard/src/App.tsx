import { useEffect, useState } from 'react';
import { Atmosphere } from './components/atmosphere/Atmosphere';
import { Landing } from './pages/Landing';

type Appearance = 'dark' | 'light';

const STORAGE_KEY = 'satchida-console-appearance';

function readAppearance(): Appearance {
  return document.documentElement.dataset.appearance === 'light' ? 'light' : 'dark';
}

export function App(): JSX.Element {
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    try {
      localStorage.setItem(STORAGE_KEY, appearance);
    } catch {
      /* Storage denied — the choice simply will not persist. */
    }
  }, [appearance]);

  return (
    <div className="stage">
      <Atmosphere />
      <button
        type="button"
        className="appearance-toggle"
        aria-label={`Switch to ${appearance === 'dark' ? 'light' : 'dark'} appearance`}
        onClick={() => setAppearance(appearance === 'dark' ? 'light' : 'dark')}
      >
        <span className="appearance-toggle__orb" data-appearance={appearance} aria-hidden="true" />
      </button>
      <div className="content">
        <Landing />
      </div>
    </div>
  );
}
