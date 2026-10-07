export * from './types';
export * from './stats/types';

export { parseChat } from './parse/parse';
export { stripInvisible } from './parse/patterns';
export {
  applyAliases,
  isUnsavedSender,
  roster,
  suggestMerges,
  unsavedParticipants,
} from './parse/identity';
export type { MergeSuggestion, RosterEntry } from './parse/identity';

export {
  detectLanguage,
  isRtl,
  minWordLength,
  wordSegmenterFor,
  stopwordsFor,
  type ChatLanguage,
} from './lang/language';

export { computeStats, dayKey, monthKey } from './stats/stats';
export {
  countLaughter,
  countWords,
  extractEmoji,
  extractLinks,
  extractWords,
} from './stats/text';

export { computeVoiceProfiles } from './stats/voice';
export type { VoiceProfile } from './stats/voice';

export { isSubstantive, looksPasted, pickVoiceSamples, substanceOf } from './stats/samples';
export type { VoiceSampleOptions } from './stats/samples';

export { inferGenders } from './stats/gender';
export type { GrammaticalGender } from './stats/gender';

export {
  conversationMessages,
  scoreRecall,
  segmentConversations,
} from './sessions/sessions';
export type { Conversation, SessionOptions } from './sessions/sessions';

export { analyzePhrases, signatureWords } from './patterns/phrases';
export type {
  PhraseContagion,
  PhraseOptions,
  PhraseReport,
  PhraseUse,
  RepeatedPhrase,
  SignaturePhrase,
  SignatureWord,
} from './patterns/phrases';

export { analyzeInteractions, monologueMessages } from './patterns/interactions';
export type {
  ConversationKiller,
  InteractionOptions,
  InteractionReport,
  Mention,
  Monologue,
  Pair,
} from './patterns/interactions';

export { analyzeCommitments, findStalledPlans, planMessages } from './patterns/commitments';
export type {
  CommitmentKind,
  CommitmentProfile,
  CommitmentReport,
  QuestionKind,
  QuestionProfile,
  RepeatedArrival,
  StalledPlan,
} from './patterns/commitments';

export * from './report/schema';
export { normalizeWrittenDeck } from './report/normalize';
export { computeScoreAxes } from './report/scores';
export type { ScoreAxis, ScoreInput } from './report/scores';
export { planDeck } from './report/plan';
export type {
  DeckPlan,
  PlanInput,
  PlanOptions,
  SlideBrief,
  SuppressionNote,
} from './report/plan';
export {
  createVerificationContext,
  dedupeVerdicts,
  isDuplicate,
  numbersIn,
  similarity,
  verifyDictionary,
  verifyFinding,
  verifySlideCopy,
} from './report/verify';
export type { AllowedFigures, TokenSource, VerificationContext } from './report/verify';

export { findCandidateMoments, getWindowMessages } from './moments/moments';
export type { MomentOptions, MomentSignals, MomentWindow } from './moments/moments';

export {
  anonymizeMessages,
  createPseudonymizer,
  evidenceId,
  identifyMessages,
  parseEvidenceId,
  restoreDeep,
  transcriptLine,
} from './anonymize/anonymize';
export type { AnonymizedMessage, Pseudonymizer } from './anonymize/anonymize';
