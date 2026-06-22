import { DECISION_STAGES } from '@/lib/c3/decisionStages'

const CARD_BG = '#0F2140'
const ORANGE = '#E8520A'
const TRACK_LINE = 'rgba(232,82,10,0.35)'

export default function DecisionJourneyVisual() {
  return (
    <div style={{
      backgroundColor: CARD_BG,
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '14px',
      padding: '32px',
    }}>
      <h2 style={{
        fontSize: '18px',
        fontWeight: 700,
        color: '#FFFFFF',
        margin: '0 0 8px',
        lineHeight: 1.3,
      }}>
        The 7 Stages of Buyer Decision Making
      </h2>
      <p style={{
        fontSize: '14px',
        color: 'rgba(255,255,255,0.6)',
        margin: '0 0 32px',
        lineHeight: 1.55,
        maxWidth: '640px',
      }}>
        Every buyer moves through these seven stages. The C3 Method helps you understand and influence each one.
      </p>

      <div className="decision-journey-track" style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '12px',
      }}>
        {/* Horizontal track line behind the nodes (hidden when stacked) */}
        <div className="decision-journey-track-line" style={{
          position: 'absolute',
          top: '21px',
          left: '7.14%',
          right: '7.14%',
          height: '2px',
          backgroundColor: TRACK_LINE,
          zIndex: 0,
        }} />

        {DECISION_STAGES.map((stage) => (
          <div
            key={stage.number}
            className="decision-journey-stage"
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            {/* Numbered node — orange filled circle with a ring in the card color
                so it cleanly overlays the track line behind it. */}
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: ORANGE,
              border: `3px solid ${CARD_BG}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {stage.number}
            </div>

            <div className="decision-journey-stage-text" style={{ marginTop: '14px' }}>
              <p style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#FFFFFF',
                margin: '0 0 4px',
              }}>
                {stage.name}
              </p>
              <p style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.55)',
                margin: 0,
                lineHeight: 1.45,
              }}>
                {stage.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Stack vertically on narrow widths so the 7-across layout doesn't squish. */}
      <style>{`
        @media (max-width: 820px) {
          .decision-journey-track {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }
          .decision-journey-track-line {
            display: none !important;
          }
          .decision-journey-stage {
            flex-direction: row !important;
            align-items: flex-start !important;
            text-align: left !important;
            gap: 14px !important;
          }
          .decision-journey-stage-text {
            margin-top: 0 !important;
            text-align: left !important;
            flex: 1;
          }
        }
      `}</style>
    </div>
  )
}
