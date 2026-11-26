import type { SpeciesCard } from '@wildwindow/shared/api';

import { MarkdownBody } from '@/components/markdown-body';
import { formatReviewedAt, parseCardSettings, sceneLabel, settingKeyLabel } from '@/lib/field-card';

export type SpeciesFieldCardProps = {
  readonly card: SpeciesCard;
  readonly timeZone: string;
};

/** Reviewed field card body for W-03 (settings, fieldcraft, ethics, legal). */
export function SpeciesFieldCard({ card, timeZone }: SpeciesFieldCardProps) {
  const parsed = parseCardSettings(card.settings);
  const hasSettings = parsed.scenes.length > 0 || parsed.rows.length > 0;
  const reviewedDate = formatReviewedAt(card.reviewedAt, timeZone);

  return (
    <section
      className="space-y-8"
      data-testid="species-field-card"
      aria-labelledby="field-card-heading"
    >
      <div>
        <h2
          id="field-card-heading"
          className="font-[family-name:var(--font-fraunces)] text-2xl text-forest-800"
        >
          Field card
        </h2>
        <p className="mt-1 text-sm text-ink-muted" data-testid="field-card-reviewed">
          Reviewed by {card.reviewedBy}, {reviewedDate}
        </p>
      </div>

      {hasSettings ? (
        <div className="space-y-5" data-testid="field-card-settings">
          <h3 className="font-[family-name:var(--font-fraunces)] text-xl text-forest-800">
            Starting camera settings
          </h3>
          {parsed.rows.length > 0 ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {parsed.rows.map((row) => (
                <div
                  key={`flat-${row.key}`}
                  className="flex justify-between gap-4 border-b border-forest-800/10 py-2"
                >
                  <dt className="text-ink-muted">{settingKeyLabel(row.key)}</dt>
                  <dd className="font-medium text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {parsed.scenes.map((scene) => (
            <div key={scene.id} className="space-y-2" data-testid={`setting-scene-${scene.id}`}>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-forest-600">
                {sceneLabel(scene.id)}
              </h4>
              <dl className="grid gap-2 sm:grid-cols-2">
                {scene.rows.map((row) => (
                  <div
                    key={`${scene.id}-${row.key}`}
                    className="flex justify-between gap-4 border-b border-forest-800/10 py-2"
                  >
                    <dt className="text-ink-muted">{settingKeyLabel(row.key)}</dt>
                    <dd className="font-medium text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : null}

      <div data-testid="field-card-body">
        <h3 className="mb-3 font-[family-name:var(--font-fraunces)] text-xl text-forest-800">
          Fieldcraft
        </h3>
        <MarkdownBody source={card.bodyMd} testId="field-card-body-md" />
      </div>

      {card.ethicsMd !== null && card.ethicsMd.trim().length > 0 ? (
        <div data-testid="field-card-ethics">
          <h3 className="mb-3 font-[family-name:var(--font-fraunces)] text-xl text-forest-800">
            Ethics
          </h3>
          <MarkdownBody source={card.ethicsMd} testId="field-card-ethics-md" />
        </div>
      ) : null}

      {card.legalMd !== null && card.legalMd.trim().length > 0 ? (
        <div data-testid="field-card-legal">
          <h3 className="mb-3 font-[family-name:var(--font-fraunces)] text-xl text-forest-800">
            Legal notes
          </h3>
          <MarkdownBody source={card.legalMd} testId="field-card-legal-md" />
        </div>
      ) : null}
    </section>
  );
}
