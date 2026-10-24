import { useContext, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TStartupConfig } from 'librechat-data-provider';
import { ThemeContext, isDark } from '@librechat/client';
import { ErrorMessage } from '~/components/Auth/ErrorMessage';
import MandalaStage from '~/components/Landing/MandalaStage';
import LandingThemeSelector from '~/components/Theme/LandingThemeSelector';
import { TranslationKeys, useLocalize } from '~/hooks';
import SocialLoginRender from './SocialLoginRender';
import { BlinkAnimation } from './BlinkAnimation';
import { Banner } from '../Banners';
import Footer from './Footer';

function AuthLayout({
  children,
  header,
  isFetching,
  startupConfig,
  startupConfigError,
  pathname,
  error,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  isFetching: boolean;
  startupConfig: TStartupConfig | null | undefined;
  startupConfigError: unknown | null | undefined;
  pathname: string;
  error: TranslationKeys | null;
}) {
  const localize = useLocalize();
  const { theme } = useContext(ThemeContext);
  const darkWordmark = isDark(theme);
  const appTitle = startupConfig?.appTitle ?? 'Satchida';

  /**
   * This route is where every unauthenticated visitor lands — `buildLoginRedirectUrl`
   * sends `/` here — so it doubles as the marketing page. The sign-in form is one
   * click away rather than permanently occupying the centre of the screen, and
   * `?signin=1` opens it directly for bookmarked and shared links.
   */
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(() => searchParams.get('signin') === '1');

  const hasStartupConfigError = startupConfigError !== null && startupConfigError !== undefined;
  const DisplayError = () => {
    if (hasStartupConfigError) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize('com_auth_error_login_server')}</ErrorMessage>
        </div>
      );
    } else if (error === 'com_auth_error_invalid_reset_token') {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>
            {localize('com_auth_error_invalid_reset_token')}{' '}
            <a
              className="font-semibold text-accent-primary hover:underline"
              href="/forgot-password"
            >
              {localize('com_auth_click_here')}
            </a>{' '}
            {localize('com_auth_to_try_again')}
          </ErrorMessage>
        </div>
      );
    } else if (error != null && error) {
      return (
        <div className="mx-auto sm:max-w-sm">
          <ErrorMessage>{localize(error)}</ErrorMessage>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="satchida-auth-shell relative min-h-screen bg-surface-primary">
      <Banner />

      {/* Sign-in is a corner affordance until asked for, so the artwork and the
          pitch own the screen. */}
      <div className="landing-auth">
        {showForm ? (
          <div className="satchida-auth-card w-authPageWidth overflow-hidden bg-surface-primary px-6 py-4 sm:rounded-lg">
            {!hasStartupConfigError && !isFetching && header && (
              <h1
                className="mb-4 text-center text-3xl font-semibold text-text-primary"
                style={{ userSelect: 'none' }}
              >
                {header}
              </h1>
            )}
            {children}
            {!pathname.includes('2fa') &&
              (pathname.includes('login') || pathname.includes('register')) && (
                <SocialLoginRender startupConfig={startupConfig} />
              )}
          </div>
        ) : (
          <button type="button" className="landing-signin" onClick={() => setShowForm(true)}>
            {localize('com_marketing_sign_in')}
          </button>
        )}
      </div>

      <DisplayError />
      <div className="landing-corner">
        <LandingThemeSelector />
      </div>

      <main className="landing-main">
        <MandalaStage>
          <BlinkAnimation active={isFetching}>
            <div
              className="satchida-auth-brand"
              role="img"
              aria-label={localize('com_ui_logo', { 0: appTitle })}
            >
              <div className="satchida-auth-brand__frame" aria-hidden="true">
                <div className="satchida-auth-brand__halo" />
                <div className="satchida-auth-brand__pulse">
                  <img
                    className="satchida-auth-brand__mandala"
                    src={`/assets/satchida/satchida-splash-mandala${darkWordmark ? '-dark' : ''}.png?v=clean10`}
                    alt=""
                  />
                </div>
                <div className="satchida-auth-brand__sweep">
                  <div />
                </div>
              </div>
            </div>
          </BlinkAnimation>
        </MandalaStage>

        {/* Kept outside the stage: inside it, the block is what gets centred,
            which pushed the mark off the stage's axis and left the tag ring no
            room above. */}
        <div className="landing-wordmark">
          <img
            className="satchida-auth-brand__wordmark"
            src={`/assets/satchida/satchida-splash-wordmark${darkWordmark ? '-dark' : ''}.png`}
            alt=""
          />
          <p className="satchida-auth-brand__tagline" aria-hidden="true">
            <span>{localize('com_ui_brand_local_first')}</span>
            <i />
            <span>{localize('com_ui_brand_zero_telemetry')}</span>
            <i />
            <span>{localize('com_ui_brand_native_sovereignty')}</span>
          </p>
        </div>


        <div className="landing-hero">
          <p className="landing-hero__eyebrow">{localize('com_marketing_hero_eyebrow')}</p>
          <h2 className="landing-hero__title">{localize('com_marketing_hero_title')}</h2>
          <p className="landing-hero__lede">{localize('com_marketing_hero_lede')}</p>
        </div>
      </main>

      <Footer startupConfig={startupConfig} />
    </div>
  );
}

export default AuthLayout;
