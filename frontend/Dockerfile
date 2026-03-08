FROM node:20-bookworm

WORKDIR /app/frontend

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ ./
COPY services/user/schema.graphql /app/services/user/schema.graphql

RUN npm run codegen

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
