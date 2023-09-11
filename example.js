let MetaApi = require('metaapi.cloud-sdk').default;

let token = process.env.TOKEN || 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiIyMzI0MDA4MjdhMzE0MjM4MTBhZjY0NDQ0NWMwZDc3ZSIsInBlcm1pc3Npb25zIjpbXSwidG9rZW5JZCI6IjIwMjEwMjEzIiwiaW1wZXJzb25hdGVkIjpmYWxzZSwicmVhbFVzZXJJZCI6IjIzMjQwMDgyN2EzMTQyMzgxMGFmNjQ0NDQ1YzBkNzdlIiwiaWF0IjoxNjk0MTI0ODA0fQ.NUGxTX3pO9srneSU47UphFEk6qFLHU6h3FEvL6CBgqOrG-RamWe-n1ZI8SEzYuaOc7k6aHe_R0CvP64_Oh3AQyOFtFuBAmOSAgOTx0YCHZUzUYiOb3u4TjRfw7ziDovLBfeI3hkJymwEJ1SSxMjdXrrFJoSxM92N3ENqB63fe04g26woI2QKR8iE4Ka4sToV0SqabtVaOvvGWKNQXq1HYjT1d1RRDh7i5ps8xc-ExS1YUEGETFI5QGV0rKVN1j_ksAApO4-GzVsN0Q8REHEMw-jgjieAObwGFl1vMI7VmuSIbXGGilLaCJesT811tRcN-jdLjfs7-pqPBY0MrH5z2QtpYHL_kgy4s77dnk8Qiyfsietd2TsNWjjMjCFHAwRI2tjcRQixh5R7JH0guSpg0jvWypgumhZOvx936xjHZe59gtYkoRNgIJB2mmuvYSU_evqw5fqOhfmpEQFpA3kvBfW_aPrlkRVKeY0konVZrrm-Pv-gVTNFDoMC9JFeCFC7NuJpphPYWXeQTDAW4B_T2wz1jL_VP-SNd3UP15OE53EzkNWxN2iEvdSf9v5zn7rOJSz9ZTWOquGw2h4u2qW2kD08fL-X-eOi-fvRsJ1fXzo27x8FFhlNAJPnpAi0kIcBurzjM2o_wYnrC0OZbqyJU8Cnq_8L-ILBiznfiuo8EUw';
let accountId = process.env.ACCOUNT_ID || '370b1496-43ed-45e6-a416-eabb361dfed9';
const api = new MetaApi(token);

async function testMetaApiSynchronization() {
  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);
    const initialState = account.state;
    const deployedStates = ['DEPLOYING', 'DEPLOYED'];

    if(!deployedStates.includes(initialState)) {
      // wait until account is deployed and connected to broker
      console.log('Deploying account');
      await account.deploy();
    }
    console.log('Waiting for API server to connect to broker (may take couple of minutes)');
    await account.waitConnected();

    // connect to MetaApi API
    let connection = account.getStreamingConnection();
    await connection.connect();

    // wait until terminal state synchronized to the local state
    console.log('Waiting for SDK to synchronize to terminal state (may take some time depending on your history size)');
    await connection.waitSynchronized();

    // access local copy of terminal state
    console.log('Testing terminal state access');
    let terminalState = connection.terminalState;
    console.log('connected:', terminalState.connected);
    console.log('connected to broker:', terminalState.connectedToBroker);
    console.log('account information:', terminalState.accountInformation);
    console.log('positions:', terminalState.positions);
    console.log('orders:', terminalState.orders);
    console.log('specifications:', terminalState.specifications);
    console.log('EURUSD specification:', terminalState.specification('EURUSD'));
    await connection.subscribeToMarketData('EURUSD');
    console.log('EURUSD price:', terminalState.price('EURUSD'));

    // access history storage
    const historyStorage = connection.historyStorage;
    console.log('deals:', historyStorage.deals.slice(-5));
    console.log('deals with id=1:', historyStorage.getDealsByTicket(1));
    console.log('deals with positionId=1:', historyStorage.getDealsByPosition(1));
    console.log('deals for the last day:', historyStorage.getDealsByTimeRange(new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date()));
    console.log('history orders:', historyStorage.historyOrders.slice(-5));
    console.log('history orders with id=1:', historyStorage.getHistoryOrdersByTicket(1));
    console.log('history orders with positionId=1:', historyStorage.getHistoryOrdersByPosition(1));
    console.log('history orders for the last day:', historyStorage.getHistoryOrdersByTimeRange(
      new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()));

    // calculate margin required for trade
    console.log('margin required for trade', await connection.calculateMargin({
      symbol: 'GBPUSD',
      type: 'ORDER_TYPE_BUY',
      volume: 0.1,
      openPrice: 1.1
    }));

    // trade
    console.log('Submitting pending order');
    try {
      let result = await
      connection.createLimitBuyOrder('GBPUSD', 0.07, 1.0, 0.9, 2.0, {
        comment: 'comm',
        clientId: 'TE_GBPUSD_7hyINWqAlE'
      });
      console.log('Trade successful, result code is ' + result.stringCode);
    } catch (err) {
      console.log('Trade failed with result code ' + err.stringCode);
    }

    if(!deployedStates.includes(initialState)) {
      // undeploy account if it was undeployed
      console.log('Undeploying account');
      await connection.close();
      await account.undeploy();
    }

  } catch (err) {
    console.error(err);
  }
  process.exit();
}

testMetaApiSynchronization();
