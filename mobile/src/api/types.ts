/**
 * 백엔드 계약에 대한 타입 접근.
 *
 * `schema.ts`는 백엔드 OpenAPI 스펙에서 자동 생성됨 — 직접 수정 금지.
 * 재생성: npm run gen:api (openapi.json을 백엔드에서 갱신한 뒤)
 */
import type { paths, components, operations } from './generated/schema';

export type { paths, components, operations };

/** DTO 형태, 예: Schemas['TodoResponseDto'] */
export type Schemas = components['schemas'];
