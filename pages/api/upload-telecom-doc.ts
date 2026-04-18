import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'

export const config = {
  api: { bodyParser: false },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
  const [, files] = await form.parse(req)
  const file = Array.isArray(files.file) ? files.file[0] : files.file

  if (!file) return res.status(400).json({ error: '파일이 없습니다.' })

  const fileBuffer = fs.readFileSync(file.filepath)
  const ext = file.originalFilename?.split('.').pop() || 'pdf'
  const path = `telecom-docs/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('dpa-docs')
    .upload(path, fileBuffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: true,
    })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ url: path })
}
