import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type ModelProfile = {
  model_key: string;
  display_name: string;
  category: string;
  implementation_type: string;
  learning_status: string;
  version: string;
  status: string;
  summary: string;
  legacy: boolean;
  retired: boolean;
  trained: boolean;
  prospective: boolean;
};

function ModelCard({ model }: { model: ModelProfile }) {
  return (
    <Link
      to={`/models/${model.model_key}`}
      style={{
        border: '1px solid #eef2f7',
        borderRadius: 16,
        padding: 18,
        background: '#fff',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#804198',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        {model.category}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        {model.display_name}
      </div>

      <div
        style={{
          marginTop: 10,
          color: '#4b5563',
          lineHeight: 1.6,
          minHeight: 80,
        }}
      >
        {model.summary}
      </div>

      <div
        style={{
          marginTop: 18,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span className="pill-chip">{model.implementation_type}</span>

        <span className="pill-chip">{model.learning_status}</span>

        <span className="pill-chip">v{model.version}</span>
      </div>
    </Link>
  );
}

function ModelSection({
  title,
  description,
  models,
}: {
  title: string;
  description: string;
  models: ModelProfile[];
}) {
  if (models.length === 0) return null;

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 900,
            margin: 0,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: '6px 0 0',
            color: '#6b7280',
          }}
        >
          {description}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap: 18,
        }}
      >
        {models.map((model) => (
          <ModelCard key={model.model_key} model={model} />
        ))}
      </div>
    </section>
  );
}

export default function ModelRegistryPage() {
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const currentModels = models.filter(
    (model) =>
      !model.legacy &&
      !model.retired &&
      model.model_key !== 'strategy_mix' &&
      model.model_key !== 'pure_random',
  );

  const portfolioModels = models.filter(
    (model) => model.model_key === 'strategy_mix',
  );

  const controlModels = models.filter(
    (model) => model.model_key === 'pure_random',
  );

  const legacyModels = models.filter((model) => model.legacy || model.retired);

  useEffect(() => {
    fetch('/api/performance/model-registry')
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '24px',
      }}
    >
      <h1
        style={{
          fontSize: 40,
          fontWeight: 900,
          marginBottom: 8,
        }}
      >
        Model Registry
      </h1>

      <p
        style={{
          color: '#6b7280',
          marginBottom: 30,
        }}
      >
        Learn how every Drawlytics prediction model works, what it is trying to
        achieve, and how its evidence evolves over time.
      </p>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <ModelSection
            title="Current models"
            description="Active Drawlytics strategies and trained models currently used for ongoing evaluation."
            models={currentModels}
          />

          <ModelSection
            title="Portfolio system"
            description="A higher-level system that combines multiple strategies rather than acting as a single standalone model."
            models={portfolioModels}
          />

          <ModelSection
            title="Control baseline"
            description="The neutral random baseline used to judge whether other approaches are showing any meaningful advantage."
            models={controlModels}
          />

          <ModelSection
            title="Legacy experiments"
            description="Historical strategies retained for transparency and evidence continuity, but no longer treated as current Drawlytics models."
            models={legacyModels}
          />
        </>
      )}
    </main>
  );
}
