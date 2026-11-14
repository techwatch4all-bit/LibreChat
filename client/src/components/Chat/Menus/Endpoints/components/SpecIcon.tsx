import React, { memo } from 'react';
import { ProviderIcon } from '@librechat/client';
import {
  MessageSquare,
  Sparkles,
  Terminal,
  GraduationCap,
  ShieldCheck,
  Film,
  Home,
  BookOpen,
  HeartPulse,
  Sun,
  DraftingCompass,
  Wrench,
  FileText,
  Crown,
} from 'lucide-react';
import type { TModelSpec, TEndpointsConfig } from 'librechat-data-provider';
import { EntityEndpointMark, isEntityEndpoint } from '~/components/Endpoints/EntityEndpointMark';
import { URLIcon } from '~/components/Endpoints/URLIcon';
import { useProviderIcon } from '~/hooks/Endpoint';
import { getModelSpecIconURL } from '~/utils';

interface SpecIconProps {
  currentSpec: TModelSpec;
  endpointsConfig: TEndpointsConfig;
  /** Avatar of the agent this spec targets, used when the spec defines no icon of its own. */
  agentAvatarURL?: string;
  size?: number;
}

const SPEC_ICONS: Record<
  string,
  { icon: React.ComponentType<{ size?: number; className?: string }>; color: string }
> = {
  chat: { icon: MessageSquare, color: 'text-sky-400' },
  work: { icon: Sparkles, color: 'text-indigo-400' },
  vibecoding: { icon: Terminal, color: 'text-emerald-400' },
  vibecoder: { icon: Terminal, color: 'text-emerald-400' },
  study: { icon: GraduationCap, color: 'text-teal-400' },
  'study-local': { icon: GraduationCap, color: 'text-teal-400' },
  privacy: { icon: ShieldCheck, color: 'text-amber-400' },
  motion: { icon: Film, color: 'text-fuchsia-400' },
  scenemosaic: { icon: Home, color: 'text-orange-400' },
  deeptutor: { icon: BookOpen, color: 'text-teal-300' },
  'health-wellness': { icon: HeartPulse, color: 'text-rose-400' },
  'panchang-vedic': { icon: Sun, color: 'text-amber-300' },
  'architect-studio': { icon: DraftingCompass, color: 'text-cyan-400' },
  'maker-hardware': { icon: Wrench, color: 'text-lime-400' },
  'document-vault': { icon: FileText, color: 'text-blue-400' },
  pro: { icon: Crown, color: 'text-purple-300' },
};

const SpecIcon: React.FC<SpecIconProps> = ({
  currentSpec,
  endpointsConfig,
  agentAvatarURL,
  size = 18,
}) => {
  const iconURL = getModelSpecIconURL(currentSpec, agentAvatarURL);
  const endpoint = currentSpec.preset?.endpoint;
  const { provider, imageURL } = useProviderIcon({ endpoint, endpointsConfig, iconURL });
  const { provider: fallbackProvider } = useProviderIcon({ endpoint, endpointsConfig });

  if (imageURL) {
    return (
      <URLIcon
        iconURL={imageURL}
        altName={currentSpec.name}
        containerStyle={{ width: size, height: size }}
        className="icon-md shrink-0 overflow-hidden rounded-full"
        provider={fallbackProvider}
      />
    );
  }

  if (isEntityEndpoint(iconURL || endpoint)) {
    return <EntityEndpointMark endpoint={iconURL || endpoint} />;
  }

  const specKey = currentSpec.name?.toLowerCase?.() ?? '';
  const specMatch = SPEC_ICONS[specKey];
  if (specMatch) {
    const IconComponent = specMatch.icon;
    return <IconComponent size={size} className={`${specMatch.color} shrink-0`} />;
  }

  return (
    <ProviderIcon
      provider={provider}
      model={currentSpec.preset?.model}
      size={size}
      className="icon-md shrink-0"
    />
  );
};

export default memo(SpecIcon);
