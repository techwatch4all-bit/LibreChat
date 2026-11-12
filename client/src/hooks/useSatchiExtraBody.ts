import { useAtomValue } from 'jotai';
import {
  satchiStyleAtom,
  satchiModeAtom,
  satchiWebSearchAtom,
  satchiThinkAtom,
  satchiResearchAtom,
  satchiImageGenAtom,
  STYLE_PROMPTS,
  HYPERRESEARCH_PROMPT_PREFIX,
  type SatchiStyle,
  type SatchiMode,
  type SatchiThinkLevel,
} from '~/store/satchiStore';

export interface SatchiExtraBody {
  satchida_style: SatchiStyle;
  satchida_mode: SatchiMode;
  satchida_websearch: boolean;
  satchida_think: SatchiThinkLevel;
  satchida_research: boolean;
  satchida_imagegen: boolean;
}

export function useSatchiExtraBody(): {
  extraBody: SatchiExtraBody;
  style: SatchiStyle;
  mode: SatchiMode;
  stylePromptPrefix: string;
} {
  const style = useAtomValue(satchiStyleAtom);
  const mode = useAtomValue(satchiModeAtom);
  const webSearch = useAtomValue(satchiWebSearchAtom);
  const think = useAtomValue(satchiThinkAtom);
  const research = useAtomValue(satchiResearchAtom);
  const imageGen = useAtomValue(satchiImageGenAtom);

  const extraBody: SatchiExtraBody = {
    satchida_style: style,
    satchida_mode: mode,
    satchida_websearch: webSearch,
    satchida_think: think,
    satchida_research: research,
    satchida_imagegen: imageGen,
  };

  const prefixes: string[] = [];
  if (STYLE_PROMPTS[style]) {
    prefixes.push(STYLE_PROMPTS[style]);
  }
  if (research) {
    prefixes.push(HYPERRESEARCH_PROMPT_PREFIX);
  }
  const stylePromptPrefix = prefixes.join('\n\n');

  return {
    extraBody,
    style,
    mode,
    stylePromptPrefix,
  };
}

export default useSatchiExtraBody;
