import express from 'express'
<<<<<<< HEAD
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import { AuthService } from '../services/authService.ts'
import { signUserToken } from '../utils/jwt.ts'
=======
import { AuthService } from '../services/authService'
import { signUserToken } from '../utils/jwt'
>>>>>>> Stashed changes
=======
import { AuthService } from '../services/authService'
import { signUserToken } from '../utils/jwt'
>>>>>>> Stashed changes
=======
import { AuthService } from '../services/authService'
import { signUserToken } from '../utils/jwt'
>>>>>>> Stashed changes
=======
import { AuthService } from '../../services/authService'
import { signUserToken } from '../../utils/jwt'
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
import type { AnalysisResponse, AuthUser, CanonicalTier } from '@/types'

const router = express.Router()

router.post('/signup', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    const user = await AuthService.registerUser({ email, password })
    const token = signUserToken({ userId: user.id, tier: user.tier })

    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, tier: user.tier },
    })
  } catch (e: any) {
    const code = e?.code
    if (code === 'VALIDATION') return res.status(400).json({ error: e.message })
    if (code === 'EMAIL_EXISTS') return res.status(409).json({ error: e.message })
    return res.status(500).json({ error: 'Signup failed' })
  }
})

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
router.post('/login', async (req, res) => {
=======
router.post('/signin', async (req, res) => {
>>>>>>> Stashed changes
=======
router.post('/signin', async (req, res) => {
>>>>>>> Stashed changes
=======
router.post('/signin', async (req, res) => {
>>>>>>> Stashed changes
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    const user = await AuthService.authenticate({ email, password })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const token = signUserToken({ userId: user.id, tier: user.tier })
    return res.json({ token, user })
  } catch {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    return res.status(500).json({ error: 'Login failed' })
=======
    return res.status(500).json({ error: 'Signin failed' })
>>>>>>> Stashed changes
=======
    return res.status(500).json({ error: 'Signin failed' })
>>>>>>> Stashed changes
=======
    return res.status(500).json({ error: 'Signin failed' })
>>>>>>> Stashed changes
  }
})

export default router
