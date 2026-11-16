import React, { useContext, useState } from 'react';
import { useForm } from 'react-hook-form';
import { loginPage } from 'librechat-data-provider';
import { Turnstile } from '@marsidev/react-turnstile';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useRegisterUserMutation } from 'librechat-data-provider/react-query';
import { ThemeContext, SecretInput, Spinner, Button, Input, isDark } from '@librechat/client';
import type { TRegisterUser, TError } from 'librechat-data-provider';
import type { TLoginLayoutContext } from '~/common';
import { useLocalize, TranslationKeys } from '~/hooks';
import { ErrorMessage } from './ErrorMessage';

const Registration: React.FC = () => {
  const navigate = useNavigate();
  const localize = useLocalize();
  const { theme } = useContext(ThemeContext);
  const { startupConfig, startupConfigError, isFetching } = useOutletContext<TLoginLayoutContext>();

  const {
    watch,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TRegisterUser>({ mode: 'onChange' });
  const password = watch('password');

  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  type OrgType = 'school' | 'rwa' | 'corporate' | 'healthcare' | 'other';
  const [orgType, setOrgType] = useState<OrgType>('school');
  const [admissionYear, setAdmissionYear] = useState<string>(new Date().getFullYear().toString());
  const [studentId, setStudentId] = useState<string>('');
  const [rwaTowerBlock, setRwaTowerBlock] = useState<string>('');
  const [rwaFlatRoom, setRwaFlatRoom] = useState<string>('');
  const [corpDept, setCorpDept] = useState<string>('EMP');
  const [corpEmpId, setCorpEmpId] = useState<string>('');
  const [healthId, setHealthId] = useState<string>('');
  const [customId, setCustomId] = useState<string>('');

  const getComputedUniqueIdentifier = (): string => {
    switch (orgType) {
      case 'school': {
        const year = admissionYear.trim() || new Date().getFullYear().toString();
        const sid = studentId.trim();
        return sid ? `SCH-${year}-${sid}` : '';
      }
      case 'rwa': {
        const tb = rwaTowerBlock.trim();
        const rm = rwaFlatRoom.trim();
        if (!tb && !rm) return '';
        if (tb && rm) return `${tb} - Flat ${rm}`;
        return tb ? tb : `Flat ${rm}`;
      }
      case 'corporate': {
        const pfx = corpDept.trim() || 'EMP';
        const eid = corpEmpId.trim();
        return eid ? `${pfx}-${eid}` : '';
      }
      case 'healthcare': {
        const hid = healthId.trim();
        return hid ? (hid.startsWith('MED-') ? hid : `MED-${hid}`) : '';
      }
      case 'other':
      default:
        return customId.trim();
    }
  };

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');
  const validTheme = isDark(theme) ? 'dark' : 'light';

  // only require captcha if we have a siteKey
  const requireCaptcha = Boolean(startupConfig?.turnstile?.siteKey);
  const authInputClassName =
    'webkit-dark-styles transition-color peer h-auto w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 hover:border-border-light focus:border-accent-primary focus:outline-none focus-visible:border-accent-primary';
  const authSecretInputClassName = `${authInputClassName} pr-12`;
  const authLabelClassName =
    'absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-accent-primary rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4';
  const authSecretButtonClassName =
    'size-9 rounded-xl text-text-secondary-alt hover:bg-transparent hover:text-text-primary';

  const registerUser = useRegisterUserMutation({
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSuccess: () => {
      setIsSubmitting(false);
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prevCountdown) => {
          if (prevCountdown <= 1) {
            clearInterval(timer);
            navigate('/c/new', { replace: true });
            return 0;
          } else {
            return prevCountdown - 1;
          }
        });
      }, 1000);
    },
    onError: (error: unknown) => {
      setIsSubmitting(false);
      if ((error as TError).response?.data?.message) {
        setErrorMessage((error as TError).response?.data?.message ?? '');
      }
    },
  });

  const renderInput = (id: string, label: TranslationKeys, type: string, validation: object) => {
    const fieldLabel = localize(label);
    const field = register(
      id as 'name' | 'email' | 'username' | 'password' | 'confirm_password',
      validation,
    );

    return (
      <div className="mb-4">
        <div className="relative">
          {type === 'password' ? (
            <SecretInput
              id={id}
              autoComplete={id}
              aria-label={fieldLabel}
              {...field}
              aria-invalid={!!errors[id]}
              className={authSecretInputClassName}
              placeholder=" "
              data-testid={id}
              label={fieldLabel}
              labelClassName={authLabelClassName}
              controlsClassName="right-2"
              buttonClassName={authSecretButtonClassName}
            />
          ) : (
            <>
              <Input
                id={id}
                type={type}
                autoComplete={id}
                aria-label={fieldLabel}
                {...field}
                aria-invalid={!!errors[id]}
                className={authInputClassName}
                placeholder=" "
                data-testid={id}
              />
              <label htmlFor={id} className={authLabelClassName}>
                {fieldLabel}
              </label>
            </>
          )}
        </div>
        {errors[id] && (
          <span role="alert" className="mt-1 text-sm text-text-destructive">
            {String(errors[id]?.message) ?? ''}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      {errorMessage && (
        <ErrorMessage>
          {localize('com_auth_error_create')} {errorMessage}
        </ErrorMessage>
      )}
      {registerUser.isSuccess && countdown > 0 && (
        <div
          className="rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2 text-sm text-text-secondary"
          role="alert"
        >
          {localize(
            startupConfig?.emailEnabled
              ? 'com_auth_registration_success_generic'
              : 'com_auth_registration_success_insecure',
          ) +
            ' ' +
            localize('com_auth_email_verification_redirecting', { 0: countdown.toString() })}
        </div>
      )}
      {!startupConfigError && !isFetching && (
        <>
          <form
            className="mt-6"
            aria-label="Registration form"
            method="POST"
            onSubmit={handleSubmit((data: TRegisterUser) => {
              const compId = getComputedUniqueIdentifier();
              registerUser.mutate({
                ...data,
                ...(compId ? { uniqueIdentifier: compId } : {}),
                token: token ?? undefined,
              });
            })}
          >
            {renderInput('name', 'com_auth_full_name', 'text', {
              required: localize('com_auth_name_required'),
              minLength: {
                value: 3,
                message: localize('com_auth_name_min_length'),
              },
              maxLength: {
                value: 80,
                message: localize('com_auth_name_max_length'),
              },
            })}
            {renderInput('username', 'com_auth_username', 'text', {
              minLength: {
                value: 2,
                message: localize('com_auth_username_min_length'),
              },
              maxLength: {
                value: 80,
                message: localize('com_auth_username_max_length'),
              },
            })}
            {renderInput('email', 'com_auth_email', 'email', {
              required: localize('com_auth_email_required'),
              minLength: {
                value: 1,
                message: localize('com_auth_email_min_length'),
              },
              maxLength: {
                value: 120,
                message: localize('com_auth_email_max_length'),
              },
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: localize('com_auth_email_pattern'),
              },
            })}

            {/* Community & Organization Unique Identifier Section */}
            <div className="mb-4 rounded-2xl border border-border-light bg-surface-secondary/40 p-3.5">
              <label htmlFor="regOrgType" className="mb-1 block text-xs font-semibold text-text-secondary">
                Community / Organization Category
              </label>
              <select
                id="regOrgType"
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as OrgType)}
                className="mb-3 h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
              >
                <option value="school">School / University (Student Roll / Admission ID)</option>
                <option value="rwa">Residential Society / RWA (Tower & Flat No.)</option>
                <option value="corporate">Corporate / Business (Employee ID)</option>
                <option value="healthcare">Hospital / Healthcare (Staff / Medical ID)</option>
                <option value="other">Other / General Unique Reference</option>
              </select>

              {orgType === 'school' && (
                <div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="mb-1 block text-xs text-text-secondary-alt">Admission Year</label>
                      <input
                        type="text"
                        value={admissionYear}
                        onChange={(e) => setAdmissionYear(e.target.value)}
                        placeholder="e.g. 2024"
                        className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-text-secondary-alt">Permanent Roll / Admission No.</label>
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="e.g. 0482 or SRN-1092"
                        className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-text-secondary-alt">
                    Captures permanent student ID across academic years, unaffected by class/section progression.
                  </p>
                </div>
              )}

              {orgType === 'rwa' && (
                <div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary-alt">Tower / Block / Phase</label>
                      <input
                        type="text"
                        value={rwaTowerBlock}
                        onChange={(e) => setRwaTowerBlock(e.target.value)}
                        placeholder="e.g. Tower B, Block 4"
                        className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-text-secondary-alt">Flat / Plot / Room No.</label>
                      <input
                        type="text"
                        value={rwaFlatRoom}
                        onChange={(e) => setRwaFlatRoom(e.target.value)}
                        placeholder="e.g. 402, 12-A"
                        className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-text-secondary-alt">
                    Format: Tower/Block combined with your unit/flat number.
                  </p>
                </div>
              )}

              {orgType === 'corporate' && (
                <div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="mb-1 block text-xs text-text-secondary-alt">Prefix / Dept</label>
                      <input
                        type="text"
                        value={corpDept}
                        onChange={(e) => setCorpDept(e.target.value)}
                        placeholder="EMP, ENG"
                        className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-text-secondary-alt">Employee / Staff No.</label>
                      <input
                        type="text"
                        value={corpEmpId}
                        onChange={(e) => setCorpEmpId(e.target.value)}
                        placeholder="e.g. 1082"
                        className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {orgType === 'healthcare' && (
                <div>
                  <label className="mb-1 block text-xs text-text-secondary-alt">Staff / Clinician / Reg ID</label>
                  <input
                    type="text"
                    value={healthId}
                    onChange={(e) => setHealthId(e.target.value)}
                    placeholder="e.g. DOC-401 or MED-8921"
                    className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>
              )}

              {orgType === 'other' && (
                <div>
                  <label className="mb-1 block text-xs text-text-secondary-alt">Unique Reference / ID</label>
                  <input
                    type="text"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    placeholder="e.g. MEM-9041, Client ID, etc."
                    className="h-10 w-full rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>
              )}

              {getComputedUniqueIdentifier() && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="font-medium text-text-secondary-alt">Identifier Preview:</span>
                  <code className="rounded-md bg-surface-primary border border-border-light px-2 py-0.5 text-accent-primary font-mono font-medium">
                    {getComputedUniqueIdentifier()}
                  </code>
                </div>
              )}
            </div>
            {renderInput('password', 'com_auth_password', 'password', {
              required: localize('com_auth_password_required'),
              minLength: {
                value: startupConfig?.minPasswordLength || 8,
                message: localize('com_auth_password_min_length'),
              },
              maxLength: {
                value: 128,
                message: localize('com_auth_password_max_length'),
              },
            })}
            {renderInput('confirm_password', 'com_auth_password_confirm', 'password', {
              validate: (value: string) =>
                value === password || localize('com_auth_password_not_match'),
            })}

            {startupConfig?.turnstile?.siteKey && (
              <div className="my-4 flex justify-center">
                <Turnstile
                  siteKey={startupConfig.turnstile.siteKey}
                  options={{
                    ...startupConfig.turnstile.options,
                    theme: validTheme,
                  }}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            )}

            <div className="mt-6">
              <Button
                disabled={
                  Object.keys(errors).length > 0 ||
                  isSubmitting ||
                  (requireCaptcha && !turnstileToken)
                }
                type="submit"
                aria-label="Submit registration"
                variant="submit"
                className="h-12 w-full rounded-2xl"
              >
                {isSubmitting ? <Spinner /> : localize('com_auth_continue')}
              </Button>
            </div>
          </form>

          <p className="my-4 text-center text-sm font-light text-text-secondary">
            {localize('com_auth_already_have_account')}{' '}
            <a
              href={loginPage()}
              aria-label="Login"
              className="inline-flex p-1 text-sm font-medium text-accent-primary transition-colors hover:text-accent-primary-hover"
            >
              {localize('com_auth_login')}
            </a>
          </p>
        </>
      )}
    </>
  );
};

export default Registration;
