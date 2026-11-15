import { useContext } from 'react';
import * as Menu from '@ariakit/react/menu';
import { ThemeContext, isDark } from '@librechat/client';
import { Sun, Moon, Palette, Check, Monitor } from 'lucide-react';
import { useLocalize } from '~/hooks';

export default function LandingThemeSelector() {
  const { theme, setTheme } = useContext(ThemeContext);
  const localize = useLocalize();
  const dark = isDark(theme);

  const toggleTheme = () => {
    if (theme === 'satchida-dark') {
      setTheme('satchida-light');
    } else {
      setTheme('satchida-dark');
    }
  };

  const currentThemeLabel = () => {
    switch (theme) {
      case 'satchida-dark':
        return localize('com_nav_theme_satchida_dark');
      case 'satchida-light':
        return localize('com_nav_theme_satchida_light');
      case 'dark':
        return localize('com_nav_theme_dark');
      case 'light':
        return localize('com_nav_theme_light');
      case 'system':
        return localize('com_nav_theme_system');
      default:
        return dark ? localize('com_nav_theme_satchida_dark') : localize('com_nav_theme_satchida_light');
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-full border border-border-light/40 bg-surface-primary/70 p-1 backdrop-blur-md shadow-lg">
      <button
        type="button"
        onClick={toggleTheme}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-tertiary/70"
        title={dark ? 'Switch to Satchida Light' : 'Switch to Satchida Dark'}
        aria-label="Toggle Satchida Theme"
      >
        {dark ? <Moon className="h-4 w-4 text-cyan-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
        <span className="hidden sm:inline">{dark ? 'Satchida Dark' : 'Satchida Light'}</span>
      </button>

      <Menu.MenuProvider placement="top-start">
        <Menu.MenuButton
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-tertiary/70 hover:text-text-primary"
          aria-label="Choose theme"
          title="All themes"
        >
          <Palette className="h-4 w-4" />
        </Menu.MenuButton>
        <Menu.Menu
          portal
          gutter={8}
          className="account-settings-popover popover-ui z-[130] w-[220px] rounded-xl border border-border-light/40 bg-surface-primary/95 p-1.5 backdrop-blur-xl shadow-2xl"
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Satchida Themes
          </div>
          <Menu.MenuItem
            onClick={() => setTheme('satchida-dark')}
            className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-tertiary/70"
          >
            <span className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-cyan-400" />
              {localize('com_nav_theme_satchida_dark')}
            </span>
            {theme === 'satchida-dark' && <Check className="h-3.5 w-3.5 text-accent-primary" />}
          </Menu.MenuItem>
          <Menu.MenuItem
            onClick={() => setTheme('satchida-light')}
            className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-tertiary/70"
          >
            <span className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              {localize('com_nav_theme_satchida_light')}
            </span>
            {theme === 'satchida-light' && <Check className="h-3.5 w-3.5 text-accent-primary" />}
          </Menu.MenuItem>

          <div className="my-1 border-t border-border-light/30" />
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Standard Themes
          </div>
          <Menu.MenuItem
            onClick={() => setTheme('dark-black')}
            className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-tertiary/70"
          >
            <span className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-zinc-100" />
              {localize('com_nav_theme_dark_black')}
            </span>
            {theme === 'dark-black' && <Check className="h-3.5 w-3.5 text-accent-primary" />}
          </Menu.MenuItem>
          <Menu.MenuItem
            onClick={() => setTheme('dark')}
            className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-tertiary/70"
          >
            <span className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-text-secondary" />
              {localize('com_nav_theme_dark')}
            </span>
            {theme === 'dark' && <Check className="h-3.5 w-3.5 text-accent-primary" />}
          </Menu.MenuItem>
          <Menu.MenuItem
            onClick={() => setTheme('light')}
            className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-tertiary/70"
          >
            <span className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-text-secondary" />
              {localize('com_nav_theme_light')}
            </span>
            {theme === 'light' && <Check className="h-3.5 w-3.5 text-accent-primary" />}
          </Menu.MenuItem>
          <Menu.MenuItem
            onClick={() => setTheme('system')}
            className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-tertiary/70"
          >
            <span className="flex items-center gap-2">
              <Monitor className="h-3.5 w-3.5 text-text-secondary" />
              {localize('com_nav_theme_system')}
            </span>
            {theme === 'system' && <Check className="h-3.5 w-3.5 text-accent-primary" />}
          </Menu.MenuItem>
        </Menu.Menu>
      </Menu.MenuProvider>
    </div>
  );
}
