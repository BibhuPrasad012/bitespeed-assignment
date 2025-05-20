import express from 'express'
import dotenv from 'dotenv'
import { identify } from './identify'
import { Request, Response, NextFunction } from 'express'

dotenv.config()

const app = express()
app.use(express.json())
app.post('/identify', (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(identify(req, res)).catch(next)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
