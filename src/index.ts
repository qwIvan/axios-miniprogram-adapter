import { AxiosRequestConfig, AxiosPromise } from 'axios'
import utils from 'axios/lib/utils'
import settle from 'axios/lib/core/settle'
import buildURL from 'axios/lib/helpers/buildURL'
import encode from './utils/encoder'
import { getRequest, transformError, transformResponse } from './utils/platForm'

const warn = console.warn
export default function mpAdapter (config: AxiosRequestConfig) :AxiosPromise {
  const request = getRequest()
  return new Promise((resolve, reject) => {
    let requestTask: void | requestTask
    let requestData = config.data
    let requestHeaders = config.headers
    // baidu miniprogram only support upperCase
    let requestMethod = (config.method && config.method.toUpperCase()) || 'GET'
    // miniprogram network request config
    const mpRequestOption: NetworkRequestOpts = {
      method: requestMethod as NetworkRequestMethod,
      url: buildURL(config.url, config.params, config.paramsSerializer),
      // Listen for success
      success: (mpResponse: NetworkRequestRes) => {
        const response = transformResponse(mpResponse, config, mpRequestOption)
        settle(resolve, reject, response)
      },
      // Handle request Exception
      fail: (error) => {
        transformError(error, reject, config)
      },
      complete () {
        requestTask = undefined
      }
    }

    // HTTP basic authentication
    if (config.auth) {
      const [username, password] = [config.auth.username || '', config.auth.password || '']
      requestHeaders.Authorization = 'Basic ' + encode(username + ':' + password)
    }

    // Set the request timeout
    if (config.timeout !== 0) {
      warn('The "timeout" option is not supported by miniprogram. For more information about usage see "https://developers.weixin.qq.com/miniprogram/dev/framework/config.html#全局配置"')
    }

    // Add headers to the request
    utils.forEach(requestHeaders, function setRequestHeader (val: any, key: string) {
      const _header = key.toLowerCase()
      if ((typeof requestData === 'undefined' && _header === 'content-type') || _header === 'referer') {
        // Remove Content-Type if data is undefined
        // And the miniprogram document said that '设置请求的 header，header 中不能设置 Referer'
        delete requestHeaders[key]
      } else if (typeof requestData === 'string' && _header === 'content-type' && val === 'application/x-www-form-urlencoded') {
        // Wechat miniprograme document:对于 POST 方法且 header['content-type'] 为 application/x-www-form-urlencoded 的数据，小程序会将数据转换成 query string （encodeURIComponent(k)=encodeURIComponent(v)&encodeURIComponent(k)=encodeURIComponent(v)...
        // Specialized processing of wechat,jsut pass the object parameters
        try {
          requestData = JSON.parse(requestData)
        } catch (error) {
        }
      }
    })
    mpRequestOption.header = requestHeaders

    // Add responseType to request if needed
    if (config.responseType) {
      mpRequestOption.responseType = config.responseType as responseType
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled (cancel) {
        if (!requestTask) {
          return
        }
        requestTask.abort()
        reject(cancel)
        // Clean up request
        requestTask = undefined
      })
    }

    if (requestData !== undefined) {
      mpRequestOption.data = requestData
    }
    requestTask = request(mpRequestOption)
  })
}
