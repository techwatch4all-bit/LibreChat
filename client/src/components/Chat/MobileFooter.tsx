import { memo } from 'react';
import { Constants } from 'librechat-data-provider';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

function MobileFooter() {
  const { data: config } = useGetStartupConfig();
  const localize = useLocalize();

  const privacyUrl = config?.interface?.privacyPolicy?.externalUrl;
  const termsUrl = config?.interface?.termsOfService?.externalUrl;

  return (
    <div className="relative z-20 flex w-full shrink-0 items-center justify-center gap-2 px-3 py-1.5 text-[11px] text-text-muted">
      <a
        href="https://satchida.com"
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap text-text-muted hover:underline"
      >
        {`Satchida ${Constants.VERSION}`}
      </a>
      {privacyUrl != null && (
        <>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <a
            href={privacyUrl}
            rel="noreferrer"
            className="whitespace-nowrap text-text-muted hover:underline"
          >
            {localize('com_ui_privacy_policy')}
          </a>
        </>
      )}
      {termsUrl != null && (
        <>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <a
            href={termsUrl}
            rel="noreferrer"
            className="whitespace-nowrap text-text-muted hover:underline"
          >
            {localize('com_ui_terms_of_service')}
          </a>
        </>
      )}
    </div>
  );
}

export default memo(MobileFooter);
