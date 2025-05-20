import { Request, Response } from 'express'
import pool from './db'

export const identify = async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Email or phoneNumber required' })
  }

  try {
    const query = `
      SELECT * FROM contacts
      WHERE email = $1 OR phone_number = $2
    `
    const { rows } = await pool.query(query, [email, phoneNumber])

    if (rows.length === 0) {
      // No match: create new primary
      const insertQuery = `
        INSERT INTO contacts (email, phone_number, link_precedence)
        VALUES ($1, $2, 'primary')
        RETURNING *
      `
      const {
        rows: [newContact],
      } = await pool.query(insertQuery, [email, phoneNumber])

      return res.json({
        contact: {
          primaryContatctId: newContact.id,
          emails: [newContact.email],
          phoneNumbers: [newContact.phone_number],
          secondaryContactIds: [],
        },
      })
    }

    // There are matching contacts
    const allContacts = [...rows]
    const primary =
      allContacts.find((c) => c.link_precedence === 'primary') || allContacts[0]

    // Create secondary if new info
    const exists = allContacts.some(
      (c) => c.email === email && c.phone_number === phoneNumber
    )

    let newSecondary
    if (!exists && (email || phoneNumber)) {
      const insertQuery = `
        INSERT INTO contacts (email, phone_number, link_precedence, linked_id)
        VALUES ($1, $2, 'secondary', $3)
        RETURNING *
      `
      const {
        rows: [secondary],
      } = await pool.query(insertQuery, [email, phoneNumber, primary.id])
      allContacts.push(secondary)
      newSecondary = secondary
    }

    // Consolidate data
    const emails = Array.from(
      new Set(allContacts.map((c) => c.email).filter(Boolean))
    )
    const phones = Array.from(
      new Set(allContacts.map((c) => c.phone_number).filter(Boolean))
    )
    const secondaryIds = allContacts
      .filter((c) => c.link_precedence === 'secondary')
      .map((c) => c.id)

    return res.json({
      contact: {
        primaryContatctId: primary.id,
        emails: [primary.email, ...emails.filter((e) => e !== primary.email)],
        phoneNumbers: [
          primary.phone_number,
          ...phones.filter((p) => p !== primary.phone_number),
        ],
        secondaryContactIds: secondaryIds,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
