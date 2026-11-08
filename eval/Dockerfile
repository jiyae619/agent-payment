# Eval runner image for `ast project start`. Only what the eval imports: zod + lib/scripts/data.
FROM node:24-slim
WORKDIR /app
COPY eval/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY lib ./lib
COPY scripts ./scripts
COPY data/fixtures ./data/fixtures
COPY data/policies.json ./data/policies.json
COPY eval ./eval
# Run the eval once, then stay idle so a container restart can't re-run it and spend credits.
CMD ["sh", "-c", "node scripts/eval-entry.mts; echo 'Eval finished. Press Ctrl+C to stop.'; sleep infinity"]
