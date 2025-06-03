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
  searchName?: string
  description: string
  lastEdit: string
  age: string
  participants?: string
  submitter?: string
  createdAt: Date
  completedAt?: string
  duration?: string
}

type Employee = {
  searchName: string
  name: string
  tasks: number
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

  async listTickets(options?: {
    /** Number of tickets returned. Default is 30 */
    limit?: number
    skip?: number
  }) {
    const page = await this.browser.newPage()

    const url = new URL("https://wticket-pcrolin.multitrader.nl/jsp/atsc/UITableIFrame.jsp?queryid=wf1act")

    if (options?.limit) url.searchParams.set("maxrows", options.limit.toString())
    if (options?.skip) url.searchParams.set("rel", options.skip.toString())

    await page.goto(url.toString())
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

        if (ticketNumber && description && lastEdit && age && createdAt) {
          const createdAtDate = new Date()
          const [day, month, year] = createdAt.split('-')
          createdAtDate.setFullYear(Number(year), Number(month) - 1, Number(day))

          tickets.push({
            number: Number(ticketNumber),
            searchName: searchName === '' ? undefined : searchName ?? undefined,
            description,
            lastEdit,
            age,
            participants: participants === '' ? undefined : participants ?? undefined,
            submitter: submitter === '' ? undefined : submitter ?? undefined,
            createdAt: createdAtDate,
            completedAt: completedAt === '' ? undefined : completedAt ?? undefined,
            duration: duration === '' ? undefined : duration ?? undefined
          })
        }
      }
      return tickets
    } else {
      throw new Error("Table not found")
    }
  }

  async listNewTickets() {
    const page = await this.browser.newPage()

    const url = new URL("https://wticket-pcrolin.multitrader.nl/jsp/atsc/UITableIFrame.jsp?queryid=wf1actnieuw")

    // if (options?.limit) url.searchParams.set("maxrows", options.limit.toString())
    // if (options?.skip) url.searchParams.set("rel", options.skip.toString())

    await page.goto(url.toString())

    const tbody = await page.$("tbody")

    if (tbody) {
      const tickets: Ticket[] = []
      const rows = await tbody.$$("tr")
      for (const row of rows) {
        const cells = await row.$$("td")

        const ticketNumber = await cells[1].evaluate(cell => cell.textContent)
        const searchName = await cells[2].evaluate(cell => cell.textContent)
        const description = await cells[3].evaluate(cell => cell.textContent)
        const lastEdit = await cells[9].evaluate(cell => cell.textContent)
        const age = await cells[10].evaluate(cell => cell.textContent)
        const submitter = await cells[13].evaluate(cell => cell.textContent)
        const createdAt = await cells[17].evaluate(cell => cell.textContent)

        if (ticketNumber && description && lastEdit && age && createdAt) {
          const createdAtDate = new Date()
          const [day, month, year] = createdAt.split('-')
          createdAtDate.setFullYear(Number(year), Number(month) - 1, Number(day))

          tickets.push({
            number: Number(ticketNumber),
            searchName: searchName === '' ? undefined : searchName ?? undefined,
            description,
            lastEdit,
            age,
            submitter: submitter === '' ? undefined : submitter ?? undefined,
            createdAt: createdAtDate
          })
        }
      }
      return tickets
    } else {
      throw new Error("Table not found")
    }
  }

  async listEmployees() {
    const page = await this.browser.newPage()

    const url = new URL("https://wticket-pcrolin.multitrader.nl/jsp/atsc/UITableIFrame.jsp?queryid=wf1medewerkers")

    // if (options?.limit) url.searchParams.set("maxrows", options.limit.toString())
    // if (options?.skip) url.searchParams.set("rel", options.skip.toString())

    await page.goto(url.toString())

    const tbody = await page.$("tbody")

    if (tbody) {
      const employees: Employee[] = []
      const rows = await tbody.$$("tr")
      for (const row of rows) {
        const cells = await row.$$("td")

        const searchName = await cells[0].evaluate(cell => cell.textContent)
        const name = await cells[1].evaluate(cell => cell.textContent)
        const tasks = await cells[2].evaluate(cell => cell.textContent)

        if (searchName && name && tasks) {
          employees.push({
            searchName,
            name,
            tasks: Number(tasks)
          })
        }
      }
      const totalTasksEl = await page.$("#sc3")
      const totalTasks = await totalTasksEl?.evaluate(el => el.textContent) ?? undefined
      return {
        totalTasks: Number(totalTasks),
        employees
      }
    } else {
      throw new Error("Table not found")
    }
  }
}