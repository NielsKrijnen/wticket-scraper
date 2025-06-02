import puppeteer, { Browser } from "puppeteer";

export async function createWTicketScraper() {
  const browser = await puppeteer.launch()
  return new WTicketScraper(browser)
}

type LoginResponse = {
  session: string
}

type Ticket = {
  number: number
  searchName: string
  description: string
  lastEdit: string
  age: string
  participants?: string
  submitter?: string
  createdAt: Date
  completedAt?: string
  duration: string
}

class WTicketScraper {
  constructor(private browser: Browser) {}

  async login(username: string, password: string): Promise<LoginResponse> {
    const page = await this.browser.newPage()
    await page.goto("https://wticket-pcrolin.multitrader.nl")

    await page.waitForNetworkIdle()

    let session: string

    const usernameHandle = await page.$("#username")
    const passwordHandle = await page.$("#password")
    const loginButton = (await page.$$(".atsc-button")).find(button => {
      return button.evaluate(button => button.textContent === "Login")
    })

    if (usernameHandle && passwordHandle && loginButton) {
      await usernameHandle.type(username)
      await passwordHandle.type(password)
      await loginButton.click()

      await page.waitForNavigation()
    }

    const cookies = await this.browser.cookies()
    const jSessionID = cookies.find(cookie => cookie.name === "JSESSIONID")
    if (!jSessionID) {
      throw new Error("JSESSIONID cookie not found")
    } else {
      session = jSessionID.value
    }

    await page.close()

    return { session }
  }

  async logout() {
    const page = await this.browser.newPage()
    await page.goto("https://wticket-pcrolin.multitrader.nl/login/wf/logout.jsp")
  }

  async close() {
    await this.logout()
    await this.browser.close()
  }

  async listTickets() {
    const page = await this.browser.newPage()
    await page.goto("https://wticket-pcrolin.multitrader.nl/jsp/atsc/UITableIFrame.jsp?queryid=wf1act")
    const tbody = await page.$("tbody")

    if (tbody) {
      const tickets: Ticket[] = []
      const rows = await tbody.$$("tr")
      for (const row of rows) {
        const cells = await row.$$("td")

        const ticketNumber = await cells[1].evaluate(cell => cell.textContent)
        const searchName = await cells[2].evaluate(cell => cell.textContent)
        const description = await cells[3].evaluate(cell => cell.textContent)
        const lastEdit = await cells[5].evaluate(cell => cell.textContent)
        const age = await cells[6].evaluate(cell => cell.textContent)
        const participants = await cells[7].evaluate(cell => cell.textContent)
        const submitter = await cells[8].evaluate(cell => cell.textContent)
        const createdAt = await cells[9].evaluate(cell => cell.textContent)
        const completedAt = await cells[10].evaluate(cell => cell.textContent)
        const duration = await cells[11].evaluate(cell => cell.textContent)

        if (ticketNumber && searchName && description && lastEdit && age && createdAt && duration) {
          const createdAtDate = new Date()
          const [day, month, year] = createdAt.split('-')
          createdAtDate.setFullYear(Number(year), Number(month) - 1, Number(day))

          tickets.push({
            number: Number(ticketNumber),
            searchName,
            description,
            lastEdit,
            age,
            participants: participants === '' ? undefined : participants ?? undefined,
            submitter: submitter === '' ? undefined : submitter ?? undefined,
            createdAt: createdAtDate,
            completedAt: completedAt === '' ? undefined : completedAt ?? undefined,
            duration
          })
        }
      }
      return tickets
    } else {
      throw new Error("Table not found")
    }
  }
}