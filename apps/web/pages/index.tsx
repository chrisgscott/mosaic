import type { NextPage } from 'next'
import Head from 'next/head'

const Home: NextPage = () => {
  return (
    <div>
      <Head>
        <title>Mosaic</title>
        <meta name="description" content="Mosaic project" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>Welcome to Mosaic</h1>
        <p>Your AI-powered business management platform</p>
      </main>
    </div>
  )
}

export default Home