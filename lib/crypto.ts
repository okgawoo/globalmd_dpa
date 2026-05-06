/**
 * 주민번호 AES-256 암호화/복호화 유틸
 * 적용일: 2026-05-06
 * 암호화 방식: AES-256 (crypto-js)
 * 키 위치: 환경변수 NEXT_PUBLIC_ENCRYPTION_KEY (Vercel)
 *
 * [증빙] 이 파일의 존재 및 Git 커밋 타임스탬프가 암호화 적용 증빙입니다.
 */

import CryptoJS from 'crypto-js'

const ENC_PREFIX = 'ENC:'

function getKey(): string {
  const key = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || ''
  if (!key) console.warn('[crypto] NEXT_PUBLIC_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.')
  return key
}

/** 주민번호 암호화 — DB 저장 전 호출 */
export function encryptResident(plaintext: string): string {
  if (!plaintext) return ''
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext // 이미 암호화됨
  const key = getKey()
  if (!key) return plaintext
  const encrypted = CryptoJS.AES.encrypt(plaintext, key).toString()
  return ENC_PREFIX + encrypted
}

/** 주민번호 복호화 — 화면 표시 시 호출 */
export function decryptResident(ciphertext: string): string {
  if (!ciphertext) return ''
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext // 평문 (마이그레이션 전 데이터)
  const key = getKey()
  if (!key) return '복호화 불가'
  try {
    const encrypted = ciphertext.slice(ENC_PREFIX.length)
    const bytes = CryptoJS.AES.decrypt(encrypted, key)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch {
    return '복호화 오류'
  }
}

/** 주민번호 마스킹 표시용 — 뒷자리 첫 번째(성별)만 공개, 나머지 6자리 마스킹
 *  반드시 복호화된 평문을 인자로 전달할 것 (decryptResident 호출 후 사용)
 *  예: maskResident(decryptResident(stored)) → "750101-1••••••"
 */
export function maskResident(value: string): string {
  if (!value) return '-'
  const clean = value.replace(/-/g, '')
  if (clean.length <= 6) return value + '-•••••••'
  return value.slice(0, 8) + '••••••'  // 750101-1••••••
}

/** 암호화된 값인지 여부 확인 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(ENC_PREFIX) ?? false
}
