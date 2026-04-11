import requests
from typing import List
from langchain_core.tools import tool

def get_agricultural_tools(auth_token: str, backend_url: str = "http://localhost:3000") -> List:
    """
    Returns a list of tools bound to the user's current session token.
    """

    @tool
    def get_fertilizer_history(crop_id: str) -> str:
        """
        Fetch the fertilizer application history for a specific crop.
        Use this tool when the user asks about the fertilizers they applied or when they should apply next based on past data.
        """
        headers = {"Authorization": auth_token}
        try:
            response = requests.get(f"{backend_url}/api/fertilizer/{crop_id}", headers=headers)
            response.raise_for_status()
            data = response.json()
            return f"Fertilizer Data: {data}"
        except requests.exceptions.HTTPError as e:
            return f"Error fetching fertilizer data. Status code: {e.response.status_code}. Response: {e.response.text}"
        except Exception as e:
             return f"Error fetching fertilizer data: {str(e)}."

    @tool
    def get_irrigation_history(crop_id: str) -> str:
        """
        Fetch the irrigation history for a specific crop.
        Use this tool when the user asks about watering schedules, past irrigations, or water usage for their crop.
        """
        headers = {"Authorization": auth_token}
        try:
            response = requests.get(f"{backend_url}/api/irrigation/{crop_id}", headers=headers)
            response.raise_for_status()
            data = response.json()
            return f"Irrigation Data: {data}"
        except requests.exceptions.HTTPError as e:
            return f"Error fetching irrigation data. Status code: {e.response.status_code}. Response: {e.response.text}"
        except Exception as e:
             return f"Error fetching irrigation data: {str(e)}."

    @tool
    def get_weather_data(latitude: float, longitude: float, start_date: str, end_date: str) -> str:
        """
        Fetch historical or past weather data for the farm's location.
        Dates must be in 'YYYY-MM-DD' format.
        Use this tool when deciding on future actions like irrigation, considering past rainfall and temperatures.
        """
        url = (
            f"https://archive-api.open-meteo.com/v1/archive?"
            f"latitude={latitude}&longitude={longitude}&"
            f"start_date={start_date}&end_date={end_date}&"
            f"daily=precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean&timezone=auto"
        )
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
            return f"Weather Data (Daily): {data.get('daily', {})}"
        except Exception as e:
            return f"Error fetching weather data: {str(e)}."

    @tool
    def get_crop_details(crop_id: str) -> str:
        """
        Fetch basic details of a crop such as its name, type, and sowing date.
        Use this tool when the user asks for general information about a specific crop.
        """
        headers = {"Authorization": auth_token}
        try:
            response = requests.get(f"{backend_url}/api/crops/{crop_id}", headers=headers)
            response.raise_for_status()
            data = response.json()
            return f"Crop Details: {data}"
        except requests.exceptions.HTTPError as e:
            return f"Error fetching crop details. Status code: {e.response.status_code}. Response: {e.response.text}"
        except Exception as e:
             return f"Error fetching crop details: {str(e)}."

    return [get_fertilizer_history, get_irrigation_history, get_weather_data, get_crop_details]
